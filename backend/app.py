import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from hume import HumeClient
from hume.models.config import ProsodyConfig
import tempfile
import asyncio
import json
from google.cloud import speech_v1
from google.cloud.speech_v1 import types
import google.generativeai as genai
from typing import Dict, List, Any
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure CORS to allow requests from frontend
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Accept"],
        "supports_credentials": False
    }
})

# Configure API clients
HUME_API_KEY = os.getenv('HUME_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize Google Cloud Speech client
speech_client = speech_v1.SpeechClient()

# Configure Gemini
generation_config = {
    "temperature": 0.7,
    "top_p": 0.8,
    "top_k": 40,
    "max_output_tokens": 1024,
}
model = genai.GenerativeModel(model_name="gemini-pro", generation_config=generation_config)

# Russian filler words list
RUSSIAN_FILLER_WORDS = [
    'ну', 'это', 'как бы', 'вот', 'типа', 'значит', 'короче', 'так сказать',
    'в общем', 'собственно', 'как его', 'эээ', 'ммм', 'кстати', 'просто',
    'как-то так', 'в принципе', 'на самом деле', 'естественно', 'получается'
]

def allowed_file(filename, allowed_types):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_types

def async_route(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))
    return decorated_function

def count_filler_words(transcript: str) -> Dict[str, int]:
    """
    Count occurrences of Russian filler words in the transcript.
    """
    counts = {}
    transcript_lower = transcript.lower()
    
    for word in RUSSIAN_FILLER_WORDS:
        count = transcript_lower.count(word)
        if count > 0:
            counts[word] = count
            
    return counts

async def analyze_voice_emotion(audio_file_path: str) -> Dict[str, Any]:
    """
    Analyze voice emotions using Hume AI's Prosody API
    """
    try:
        client = HumeClient(HUME_API_KEY)
        config = ProsodyConfig()
        
        # Send the file for analysis
        result = client.submit_job(audio_file_path, [config])
        
        # Get the full predictions
        full_predictions = result.get_predictions()
        
        # Process emotions
        emotions = []
        if full_predictions and len(full_predictions) > 0:
            predictions = full_predictions[0]['results']['predictions']
            for pred in predictions:
                emotions.extend([{
                    'name': emotion['name'],
                    'score': emotion['score']
                } for emotion in pred['emotions']])
            
            # Find dominant emotions (top 3)
            emotions.sort(key=lambda x: x['score'], reverse=True)
            dominant_emotions = emotions[:3]
            
            return {
                'success': True,
                'emotions': emotions,
                'dominant_emotions': dominant_emotions
            }
        
        return {
            'success': False,
            'error': 'No prosody data found in the response'
        }
        
    except Exception as e:
        print(f"Error in analyze_voice_emotion: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

async def transcribe_audio(audio_file_path: str) -> Dict[str, Any]:
    """
    Transcribe audio using Google Cloud Speech-to-Text
    """
    try:
        with open(audio_file_path, 'rb') as audio_file:
            content = audio_file.read()

        audio = types.RecognitionAudio(content=content)
        config = types.RecognitionConfig(
            encoding=speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
            language_code="ru-RU",
            enable_automatic_punctuation=True,
        )

        response = speech_client.recognize(config=config, audio=audio)
        
        full_transcript = ""
        for result in response.results:
            full_transcript += result.alternatives[0].transcript + " "
            
        return {
            'success': True,
            'transcript': full_transcript.strip()
        }
        
    except Exception as e:
        print(f"Error in transcribe_audio: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def generate_feedback(transcript: str, emotion_data: Dict[str, Any], filler_words: Dict[str, int]) -> Dict[str, Any]:
    """
    Generate feedback using Google Gemini
    """
    try:
        # Construct the prompt
        prompt = f"""You are an expert public speaking coach. A user has submitted a recording of their speech in Russian. 
        Analyze the provided data and give them constructive feedback in Russian language.

        Transcript:
        {transcript}

        Vocal Emotion Analysis:
        Dominant emotions: {json.dumps(emotion_data['dominant_emotions'], ensure_ascii=False, indent=2)}
        Full emotion data: {json.dumps(emotion_data['emotions'], ensure_ascii=False, indent=2)}

        Filler Word Usage:
        {json.dumps(filler_words, ensure_ascii=False, indent=2)}

        Please provide a detailed analysis that includes:
        1. Overall impression of their emotional delivery
        2. Specific feedback on their use of filler words
        3. Constructive suggestions for improvement
        4. At least two specific exercises they can practice

        Format the response in clear sections with bullet points where appropriate.
        Keep the tone encouraging while being honest about areas for improvement."""

        # Generate feedback
        response = model.generate_content(prompt)
        
        return {
            'success': True,
            'feedback': response.text
        }
        
    except Exception as e:
        print(f"Error in generate_feedback: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

@app.route('/analyze', methods=['POST'])
@async_route
async def analyze():
    """
    Process uploaded audio file and perform comprehensive analysis
    """
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No selected audio file'}), 400

        # Save audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            audio_file.save(temp_audio.name)
            
            try:
                # 1. Analyze emotions
                emotion_analysis = await analyze_voice_emotion(temp_audio.name)
                if not emotion_analysis['success']:
                    raise Exception(f"Emotion analysis failed: {emotion_analysis.get('error')}")

                # 2. Transcribe speech
                transcription = await transcribe_audio(temp_audio.name)
                if not transcription['success']:
                    raise Exception(f"Transcription failed: {transcription.get('error')}")

                # 3. Count filler words
                filler_word_counts = count_filler_words(transcription['transcript'])

                # 4. Generate feedback
                feedback = generate_feedback(
                    transcription['transcript'],
                    emotion_analysis,
                    filler_word_counts
                )
                if not feedback['success']:
                    raise Exception(f"Feedback generation failed: {feedback.get('error')}")

                # Prepare response
                response = {
                    'transcript': transcription['transcript'],
                    'emotionalAnalysis': emotion_analysis,
                    'fillerWords': filler_word_counts,
                    'feedback': feedback['feedback']
                }

                return jsonify(response)

            finally:
                # Clean up temporary file
                os.unlink(temp_audio.name)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/test-config', methods=['GET'])
def test_config():
    """
    Test route to verify API keys are loaded
    """
    return jsonify({
        'hume_key_set': bool(HUME_API_KEY),
        'google_key_set': bool(GOOGLE_API_KEY)
    })

if __name__ == '__main__':
    if not HUME_API_KEY:
        raise ValueError("Hume AI API key not found in environment variables")
    if not GOOGLE_API_KEY:
        raise ValueError("Google API key not found in environment variables")
    app.run(debug=True, host='0.0.0.0', port=5000) 