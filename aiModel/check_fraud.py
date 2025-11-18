#!/usr/bin/env python3
"""
Fraud Detection Script for Emergency Reports
Integrates with Node.js backend via stdin/stdout
"""

import sys
import json
import joblib
import numpy as np
from datetime import datetime
import os

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def load_model():
    """Load the trained Random Forest model"""
    try:
        model_path = os.path.join(SCRIPT_DIR, 'fraud_detection_model.pkl')
        model = joblib.load(model_path)
        return model
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Failed to load model: {str(e)}'
        }), file=sys.stderr)
        sys.exit(1)

def extract_features(report_data):
    """
    Extract the 7 features needed for the model
    
    Expected input format from Node.js:
    {
        "numberOfAccidents": 3,
        "geom": {"coordinates": [31.22, 30.05]},
        "has_photo": true/false,
        "response_time_seconds": 45.5,
        "timestamp": "2024-01-15T10:30:00Z",
        "location_source": "gps" or "map_click"
    }
    """
    try:
        # 1. injured_people
        injured_people = int(report_data.get('numberOfAccidents', 0))
        
        # 2. location_source_numeric (1=map_click, 2=gps)
        location_source = report_data.get('location_source', 'map_click')
        location_source_numeric = 2 if location_source == 'gps' else 1
        
        # 3. has_photo (0 or 1)
        has_photo = 1 if report_data.get('has_photo', False) else 0
        
        # 4. response_time_seconds
        response_time = float(report_data.get('response_time_seconds', 60))
        
        # 5-7. Time-based features
        timestamp_str = report_data.get('timestamp')
        if timestamp_str:
            try:
                dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            except:
                dt = datetime.now()
        else:
            dt = datetime.now()
        
        hour_of_day = dt.hour
        
        # is_rush_hour: 7-9 AM and 3-5 PM
        is_rush_hour = 1 if hour_of_day in [7, 8, 9, 15, 16, 17] else 0
        
        # is_night: 10 PM - 6 AM
        is_night = 1 if hour_of_day in [22, 23, 0, 1, 2, 3, 4, 5] else 0
        
        # Return features in the exact order the model expects
        features = [
            injured_people,
            location_source_numeric,
            has_photo,
            response_time,
            hour_of_day,
            is_rush_hour,
            is_night
        ]
        
        return features
        
    except Exception as e:
        raise ValueError(f"Feature extraction failed: {str(e)}")

def determine_risk_level(fraud_probability):
    """Determine risk level based on fraud probability"""
    if fraud_probability < 0.3:
        return 'LOW'
    elif fraud_probability < 0.6:
        return 'MEDIUM'
    elif fraud_probability < 0.8:
        return 'HIGH'
    else:
        return 'CRITICAL'

def get_recommendation(risk_level, report_data):
    """Get action recommendation based on risk level"""
    recommendations = {
        'LOW': {
            'action': 'DISPATCH_IMMEDIATELY',
            'message': 'خطر منخفض - يمكن إرسال الإسعاف مباشرة',
            'should_block': False
        },
        'MEDIUM': {
            'action': 'FLAG_FOR_REVIEW',
            'message': 'خطر متوسط - يُفضل المراجعة السريعة',
            'should_block': False
        },
        'HIGH': {
            'action': 'VERIFY_BEFORE_DISPATCH',
            'message': 'خطر عالي - يجب الاتصال بالمُبلغ للتحقق',
            'should_block': False
        },
        'CRITICAL': {
            'action': 'BLOCK_REPORT',
            'message': 'خطر حرج - البلاغ مشبوه جداً',
            'should_block': True
        }
    }
    return recommendations.get(risk_level, recommendations['MEDIUM'])

def identify_risk_factors(report_data, fraud_probability):
    """Identify suspicious patterns in the report"""
    risk_factors = []
    
    injured = report_data.get('numberOfAccidents', 0)
    response_time = report_data.get('response_time_seconds', 60)
    has_photo = report_data.get('has_photo', False)
    location_source = report_data.get('location_source', 'map_click')
    
    # Pattern 1: Zero injuries
    if injured == 0:
        risk_factors.append({
            'factor': 'صفر إصابات (ممكن يكون مزحة)',
            'severity': 'medium'
        })
    
    # Pattern 2: Too many injuries
    if injured > 8:
        risk_factors.append({
            'factor': f'عدد إصابات مبالغ فيه ({injured})',
            'severity': 'high'
        })
    
    # Pattern 3: Fast response without photo
    if response_time < 30:
        risk_factors.append({
            'factor': f'وقت استجابة سريع جداً ({response_time:.1f}s)',
            'severity': 'high'
        })
    
    # Pattern 4: Map click without photo
    if location_source == 'map_click' and not has_photo:
        risk_factors.append({
            'factor': 'تحديد موقع يدوي بدون صورة',
            'severity': 'medium'
        })
    
    # Pattern 5: Very slow response
    if response_time > 180:
        risk_factors.append({
            'factor': f'وقت استجابة بطيء جداً ({response_time:.1f}s)',
            'severity': 'low'
        })
    
    return risk_factors

def predict_fraud(model, report_data):
    """Main prediction function"""
    try:
        # Extract features
        features = extract_features(report_data)
        features_array = np.array([features])
        
        # Make prediction
        fraud_prediction = int(model.predict(features_array)[0])
        fraud_probability = float(model.predict_proba(features_array)[0][1])
        
        # Determine risk level
        risk_level = determine_risk_level(fraud_probability)
        
        # Get recommendation
        recommendation = get_recommendation(risk_level, report_data)
        
        # Identify risk factors
        risk_factors = identify_risk_factors(report_data, fraud_probability)
        
        # Build response
        result = {
            'success': True,
            'prediction': {
                'is_fraud': fraud_prediction,
                'fraud_probability': round(fraud_probability, 4),
                'risk_level': risk_level,
                'risk_factors': risk_factors,
                'recommendation': recommendation,
                'timestamp': datetime.now().isoformat()
            }
        }
        
        return result
        
    except Exception as e:
        return {
            'success': False,
            'error': f'Prediction failed: {str(e)}'
        }

def main():
    """Main entry point - reads from stdin, writes to stdout"""
    try:
        # Load model once
        model = load_model()
        
        # Read input from Node.js
        input_data = sys.stdin.read()
        
        if not input_data:
            print(json.dumps({
                'success': False,
                'error': 'No input data received'
            }))
            sys.exit(1)
        
        # Parse JSON input
        report_data = json.loads(input_data)
        
        # Make prediction
        result = predict_fraud(model, report_data)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Invalid JSON input: {str(e)}'
        }))
        sys.exit(1)
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Unexpected error: {str(e)}'
        }))
        sys.exit(1)

if __name__ == '__main__':
    main()