import os
from dotenv import load_dotenv
import hume
from google.cloud import speech_v1
import google.generativeai as genai
import wave
import numpy as np

# Load environment variables
load_dotenv()

# Set Google Cloud credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'credentials/google-cloud-credentials.json'

def create_test_audio():
    """Create a simple test WAV file with a sine wave"""
    # Audio parameters
    duration = 3  # seconds
    sample_rate = 16000
    frequency = 440  # Hz (A4 note)
    
    # Generate sine wave
    t = np.linspace(0, duration, int(sample_rate * duration), False)
    audio_data = np.sin(2 * np.pi * frequency * t)
    audio_data = (audio_data * 32767).astype(np.int16)
    
    # Save as WAV file
    with wave.open('test_audio.wav', 'w') as wav_file:
        wav_file.setnchannels(1)  # mono
        wav_file.setsampwidth(2)  # 2 bytes per sample
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_data.tobytes())
    
    return 'test_audio.wav'

def test_hume_api():
    """Test Hume AI API connection"""
    try:
        client = hume.client.HumeClient(os.getenv('HUME_API_KEY'))
        print("✅ Hume AI API key is valid and client initialized successfully")
        return True
    except Exception as e:
        print(f"❌ Hume AI API test failed: {str(e)}")
        return False

def test_google_speech():
    """Test Google Cloud Speech-to-Text API"""
    try:
        # Check if credentials file exists
        if not os.path.exists(os.environ['GOOGLE_APPLICATION_CREDENTIALS']):
            print("❌ Google Cloud credentials file not found")
            print(f"Please place your credentials file at: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")
            return False

        client = speech_v1.SpeechClient()
        print("✅ Google Cloud Speech-to-Text client initialized successfully")
        
        # Test with audio file
        audio_file = create_test_audio()
        with open(audio_file, 'rb') as audio:
            content = audio.read()
        
        audio = speech_v1.RecognitionAudio(content=content)
        config = speech_v1.RecognitionConfig(
            encoding=speech_v1.RecognitionConfig.AudioEncoding.LINEAR16,
            language_code="ru-RU",
            sample_rate_hertz=16000,
        )
        
        response = client.recognize(config=config, audio=audio)
        print("✅ Successfully made a test API call to Speech-to-Text")
        return True
    except Exception as e:
        print(f"❌ Google Speech-to-Text test failed: {str(e)}")
        return False
    finally:
        if os.path.exists('test_audio.wav'):
            os.remove('test_audio.wav')

def test_gemini():
    """Test Google Gemini API"""
    try:
        genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content("Привет! Это тестовое сообщение.")
        print("✅ Successfully made a test API call to Gemini")
        print(f"Response: {response.text}")
        return True
    except Exception as e:
        print(f"❌ Gemini API test failed: {str(e)}")
        return False

def main():
    print("\n🔍 Testing API Configurations...")
    
    # Check environment variables
    required_vars = ['HUME_API_KEY', 'GOOGLE_API_KEY']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print("\n⚠️ Missing environment variables:")
        for var in missing_vars:
            print(f"❌ {var} is not set in .env file")
        return
    
    print("\n1. Testing Hume AI API:")
    hume_success = test_hume_api()
    
    print("\n2. Testing Google Speech-to-Text API:")
    speech_success = test_google_speech()
    
    print("\n3. Testing Google Gemini API:")
    gemini_success = test_gemini()
    
    print("\n📋 Summary:")
    print(f"Hume AI API: {'✅' if hume_success else '❌'}")
    print(f"Google Speech-to-Text: {'✅' if speech_success else '❌'}")
    print(f"Google Gemini: {'✅' if gemini_success else '❌'}")
    
    if all([hume_success, speech_success, gemini_success]):
        print("\n🎉 All APIs are configured correctly!")
    else:
        print("\n⚠️ Some APIs failed. Please check the error messages above.")
        print("\nTo fix the issues:")
        print("1. Make sure all required API keys are in your .env file")
        print("2. Verify your Google Cloud credentials file is in the correct location")
        print("3. Check that the APIs are enabled in your Google Cloud Console")
        print("4. Verify your Hume AI subscription is active")

if __name__ == "__main__":
    main() 