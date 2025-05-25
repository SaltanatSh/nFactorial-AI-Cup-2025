import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from hume import HumeStreamClient
from hume.models.config import ProsodyConfig
import tempfile
import asyncio
import json
from werkzeug.utils import secure_filename
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure Hume AI client
HUME_API_KEY = os.getenv('HUME_API_KEY')
HUME_SECRET_KEY = os.getenv('HUME_SECRET_KEY')

def async_route(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))
    return decorated_function

async def analyze_voice_emotion(audio_file_path):
    """
    Analyze voice emotions using Hume AI's Prosody API
    """
    try:
        client = HumeStreamClient(HUME_API_KEY)
        config = ProsodyConfig()
        
        async with client.connect([config]) as socket:
            result = await socket.send_file(audio_file_path)
            
            # Process emotions
            emotions = []
            if result and result.get('prosody'):
                predictions = result['prosody'][0]['predictions']
                for pred in predictions:
                    emotions.extend([{
                        'name': emotion['name'],
                        'score': emotion['score']
                    } for emotion in pred['emotions']])
                
                # Find dominant emotion
                dominant_emotion = max(emotions, key=lambda x: x['score'])
                
                return {
                    'success': True,
                    'emotions': emotions,
                    'dominant_emotion': dominant_emotion['name'],
                    'dominant_score': dominant_emotion['score']
                }
            
            return {
                'success': False,
                'error': 'No prosody data found in the response'
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

def generate_gemini_prompt(slide_analysis, transcript, emotion_data):
    """
    Generate an enhanced prompt for Gemini including emotional analysis
    """
    return f"""
    You are an expert speaking coach. Analyze the user's presentation based on three sources of data:

    1. Slide Content: {slide_analysis}

    2. Speech Transcript: {transcript}

    3. Vocal Emotion Analysis:
       - Dominant emotion: {emotion_data.get('dominant_emotion', 'N/A')}
       - Emotion scores: {json.dumps(emotion_data.get('emotions', []), indent=2)}

    Provide a comprehensive analysis that:
    1. Evaluates the alignment between content, delivery, and emotional tone
    2. Highlights effective moments
    3. Suggests specific improvements
    4. Notes any emotional patterns that could be adjusted

    Format your response with clear sections and actionable feedback.
    """

@app.route('/analyze', methods=['POST'])
@async_route
async def analyze():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No selected audio file'}), 400

        # Save audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            audio_file.save(temp_audio.name)
            
            # Analyze emotions
            emotion_analysis = await analyze_voice_emotion(temp_audio.name)
            
            if not emotion_analysis['success']:
                return jsonify({
                    'error': f"Emotion analysis failed: {emotion_analysis.get('error', 'Unknown error')}"
                }), 500

            # For now, we'll use placeholder values for slide analysis and transcript
            # These will be implemented in the next iteration
            slide_analysis = "Placeholder for slide analysis"
            transcript = "Placeholder for speech transcript"

            # Generate enhanced prompt
            prompt = generate_gemini_prompt(slide_analysis, transcript, emotion_analysis)

            # For now, return the emotion analysis and prompt
            # In the next iteration, we'll integrate with Gemini
            response = {
                'emotionalAnalysis': emotion_analysis,
                'prompt': prompt,
                'technicalMetrics': {
                    'emotions': emotion_analysis['emotions'],
                    'pacing': {'score': 0.0},  # Placeholder
                    'clarity': 0.0  # Placeholder
                }
            }

            # Clean up temporary file
            os.unlink(temp_audio.name)
            
            return jsonify(response)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    if not HUME_API_KEY or not HUME_SECRET_KEY:
        raise ValueError("Hume AI credentials not found in environment variables")
    app.run(debug=True, port=5000) 