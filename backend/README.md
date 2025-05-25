# AI-Суфлёр Backend

This is the backend service for AI-Суфлёр, a presentation coaching application that provides real-time feedback on presentation delivery.

## Setup

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the backend directory with your API keys:
```
HUME_API_KEY=your_hume_api_key
HUME_SECRET_KEY=your_hume_secret_key
FLASK_ENV=development
```

4. Run the server:
```bash
python app.py
```

The server will start on `http://localhost:5000`.

## API Endpoints

### 1. Process PDF (`/process-pdf`)
Converts a PDF presentation into a list of slide images.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `pdf`: PDF file

**Response:**
```json
{
    "success": true,
    "slides": [
        "data:image/png;base64,...",
        "data:image/png;base64,..."
    ],
    "total_slides": 2
}
```

### 2. Analyze Presentation (`/analyze`)
Analyzes the presentation delivery using voice emotion analysis.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `audio`: WAV/MP3 file
  - `slide_content`: String (current slide content/context)

**Response:**
```json
{
    "emotionalAnalysis": {
        "success": true,
        "emotions": [
            {"name": "Confidence", "score": 0.8},
            {"name": "Excitement", "score": 0.6}
        ],
        "dominant_emotion": "Confidence",
        "dominant_score": 0.8
    },
    "prompt": "...",
    "technicalMetrics": {
        "emotions": [...],
        "pacing": {"score": 0.0},
        "clarity": 0.0
    }
}
```

## Error Handling
All endpoints return appropriate error messages in case of failure:
```json
{
    "error": "Error message description"
}
```

## File Limitations
- Maximum file size: 16MB
- Supported formats:
  - Presentations: PDF
  - Audio: WAV, MP3 