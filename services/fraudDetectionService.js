/**
 * Fraud Detection Service
 * Integrates ML model with Node.js backend via Python child process
 */

const { spawn } = require('child_process');
const path = require('path');

class FraudDetectionService {
  constructor() {
    this.pythonScriptPath = path.join(__dirname, '../aiModel/check_fraud.py');
    this.timeoutMs = 5000; // 5 seconds timeout
  }

  /**
   * Check if a report is fraudulent
   * @param {Object} reportData - The report data to check
   * @returns {Promise<Object>} Fraud detection result
   */
  async checkFraud(reportData) {
    return new Promise((resolve, reject) => {
      // Prepare data for Python script
      const fraudCheckData = this.prepareReportData(reportData);
      
      // Spawn Python process
      const python = spawn('python3', [this.pythonScriptPath]);
      
      let dataString = '';
      let errorString = '';
      
      // Set timeout
      const timeout = setTimeout(() => {
        python.kill();
        reject(new Error('Fraud check timeout after 5 seconds'));
      }, this.timeoutMs);
      
      // Collect data from stdout
      python.stdout.on('data', (data) => {
        dataString += data.toString();
      });
      
      // Collect errors from stderr
      python.stderr.on('data', (data) => {
        errorString += data.toString();
      });
      
      // Handle process close
      python.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code !== 0) {
          console.error('❌ Python script error:', errorString);
          reject(new Error(`Python script exited with code ${code}`));
          return;
        }
        
        try {
          const result = JSON.parse(dataString);
          
          if (result.success) {
            console.log(`✅ Fraud check: ${result.prediction.risk_level} (${(result.prediction.fraud_probability * 100).toFixed(1)}%)`);
            resolve(result);
          } else {
            console.error('❌ Fraud check failed:', result.error);
            reject(new Error(result.error));
          }
        } catch (parseError) {
          console.error('❌ Failed to parse Python output:', dataString);
          reject(new Error('Invalid response from fraud detection model'));
        }
      });
      
      // Handle process error
      python.on('error', (error) => {
        clearTimeout(timeout);
        console.error('❌ Failed to spawn Python process:', error);
        reject(new Error('Failed to start fraud detection: ' + error.message));
      });
      
      // Send data to Python script
      python.stdin.write(JSON.stringify(fraudCheckData));
      python.stdin.end();
    });
  }

  /**
   * Prepare report data for fraud detection
   * Converts from your DB format to ML model format
   */
  prepareReportData(reportData) {
    return {
      numberOfAccidents: reportData.numberOfAccidents || 0,
      has_photo: reportData.pictureURL ? true : false,
      response_time_seconds: reportData.response_time_seconds || this.calculateResponseTime(reportData),
      timestamp: reportData.timestamp || new Date().toISOString(),
      location_source: reportData.location_source || 'gps', // or 'map_click'
      geom: reportData.geom
    };
  }

  /**
   * Calculate response time if not provided
   * (time from page load to submit)
   */
  calculateResponseTime(reportData) {
    // If you track when user opened the form, calculate difference
    // Otherwise, return a default
    return 60; // Default 60 seconds
  }

  /**
   * Wrapper with fail-safe logic
   * If fraud detection fails, allow the report (fail-open policy)
   */
  async checkFraudSafe(reportData) {
    try {
      const result = await this.checkFraud(reportData);
      return result;
    } catch (error) {
      console.error('⚠️ Fraud detection failed, allowing report (fail-open):', error.message);
      
      // Return a safe default result
      return {
        success: true,
        prediction: {
          is_fraud: 0,
          fraud_probability: 0,
          risk_level: 'UNKNOWN',
          risk_factors: [],
          recommendation: {
            action: 'DISPATCH_IMMEDIATELY',
            message: 'Fraud check unavailable - report allowed',
            should_block: false
          },
          error: error.message
        }
      };
    }
  }

  /**
   * Check if report should be blocked
   */
  shouldBlockReport(fraudResult) {
    if (!fraudResult.success || !fraudResult.prediction) {
      return false; // Fail-open: allow if check failed
    }
    
    return fraudResult.prediction.recommendation.should_block === true;
  }

  /**
   * Get fraud score for database storage
   */
  getFraudScore(fraudResult) {
    if (!fraudResult.success || !fraudResult.prediction) {
      return null;
    }
    
    return fraudResult.prediction.fraud_probability;
  }
}

// Export singleton instance
module.exports = new FraudDetectionService();