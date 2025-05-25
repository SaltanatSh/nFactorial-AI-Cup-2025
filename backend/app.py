import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from hume import HumeStreamClient
from hume.models.config import ProsodyConfig
import tempfile
import asyncio
import json
import fitz  # PyMuPDF
import base64
from io import BytesIO
from werkzeug.utils import secure_filename
from functools import wraps

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Configure CORS to allow requests from frontend
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:3000", "http://localhost:3001"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

# Configure Hume AI client
HUME_API_KEY = os.getenv('HUME_API_KEY')
HUME_SECRET_KEY = os.getenv('HUME_SECRET_KEY')

# Configure upload settings
ALLOWED_EXTENSIONS = {'pdf', 'wav', 'mp3'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

def allowed_file(filename, allowed_types):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_types

def async_route(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))
    return decorated_function

def process_pdf_to_images(pdf_file):
    """
    Convert PDF pages to base64 encoded PNG images
    """
    try:
        # Create a temporary file to save the PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_pdf:
            pdf_file.save(temp_pdf.name)
            
            # Open the PDF with PyMuPDF
            doc = fitz.open(temp_pdf.name)
            slides = []
            
            # Process each page
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # Render page to PNG with higher resolution
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better quality
                
                # Convert to base64
                img_bytes = pix.tobytes("png")
                img_base64 = base64.b64encode(img_bytes).decode()
                slides.append(f"data:image/png;base64,{img_base64}")
            
            doc.close()
            os.unlink(temp_pdf.name)
            
            return {
                'success': True,
                'slides': slides,
                'total_slides': len(slides)
            }
            
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

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

@app.route('/process-pdf', methods=['POST'])
def process_pdf():
    """
    Process uploaded PDF and convert pages to images
    """
    try:
        if 'pdf' not in request.files:
            return jsonify({'error': 'No PDF file provided'}), 400
        
        pdf_file = request.files['pdf']
        if pdf_file.filename == '':
            return jsonify({'error': 'No selected PDF file'}), 400
            
        if not allowed_file(pdf_file.filename, {'pdf'}):
            return jsonify({'error': 'Invalid file type. Please upload a PDF file'}), 400
            
        result = process_pdf_to_images(pdf_file)
        
        if not result['success']:
            return jsonify({'error': result.get('error', 'Failed to process PDF')}), 500
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze', methods=['POST'])
@async_route
async def analyze():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No selected audio file'}), 400

        if not allowed_file(audio_file.filename, {'wav', 'mp3'}):
            return jsonify({'error': 'Invalid file type. Please upload a WAV or MP3 file'}), 400

        # Save audio file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_audio:
            audio_file.save(temp_audio.name)
            
            # Analyze emotions
            emotion_analysis = await analyze_voice_emotion(temp_audio.name)
            
            if not emotion_analysis['success']:
                return jsonify({
                    'error': f"Emotion analysis failed: {emotion_analysis.get('error', 'Unknown error')}"
                }), 500

            # Get the slide content from the request
            slide_content = request.form.get('slide_content', 'No slide content provided')
            transcript = "Placeholder for speech transcript"  # To be implemented

            # Generate enhanced prompt
            prompt = generate_gemini_prompt(slide_content, transcript, emotion_analysis)

            # For now, return the emotion analysis and prompt
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