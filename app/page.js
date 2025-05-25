'use client'

import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useReactMediaRecorder } from 'react-media-recorder'
import { CloudArrowUpIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline'

export default function Home() {
  const [presentationSlides, setPresentationSlides] = useState([])
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isProcessingPDF, setIsProcessingPDF] = useState(false)
  
  const { status, startRecording, stopRecording, mediaBlobUrl } = useReactMediaRecorder({
    audio: true,
    video: false,
  })

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return

      setIsProcessingPDF(true)
      try {
        const formData = new FormData()
        formData.append('pdf', file)

        const response = await fetch('http://localhost:5000/process-pdf', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
          mode: 'cors',
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
          throw new Error(errorData.error || `Server error: ${response.status}`)
        }

        const data = await response.json()
        setPresentationSlides(data.slides)
        setActiveSlideIndex(0)
      } catch (error) {
        console.error('PDF processing failed:', error)
        if (error.message.includes('Failed to fetch')) {
          alert('Could not connect to the server. Please make sure the backend server is running.')
        } else {
          alert(`Failed to process the PDF: ${error.message}`)
        }
      } finally {
        setIsProcessingPDF(false)
      }
    }
  })

  const handleAnalysis = async () => {
    if (!presentationSlides.length || !mediaBlobUrl) {
      alert('Please upload a presentation and record your speech first.')
      return
    }

    setIsAnalyzing(true)
    try {
      // Convert the mediaBlobUrl to a File object
      const audioBlob = await fetch(mediaBlobUrl).then(r => r.blob())
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' })

      const formData = new FormData()
      formData.append('audio', audioFile)
      formData.append('slide_content', `Slide ${activeSlideIndex + 1} of ${presentationSlides.length}`)

      const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed')
      }

      setFeedback(data)
    } catch (error) {
      console.error('Analysis failed:', error)
      alert('Failed to analyze the presentation. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">1. Upload Your Presentation</h2>
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Drag & drop a PDF presentation here, or click to select</p>
            {isProcessingPDF && (
              <p className="mt-2 text-blue-500">Processing PDF...</p>
            )}
          </div>

          {/* Slide Carousel */}
          {presentationSlides.length > 0 && (
            <div className="mt-4 space-y-4">
              {/* Active Slide Preview */}
              <div className="border rounded-lg p-2">
                <img
                  src={presentationSlides[activeSlideIndex]}
                  alt={`Slide ${activeSlideIndex + 1}`}
                  className="max-h-48 mx-auto rounded-lg shadow-md"
                />
                <p className="text-center mt-2 text-sm text-gray-600">
                  Slide {activeSlideIndex + 1} of {presentationSlides.length}
                </p>
              </div>
              
              {/* Thumbnail Navigation */}
              <div className="flex overflow-x-auto space-x-2 p-2">
                {presentationSlides.map((slide, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveSlideIndex(index)}
                    className={`flex-shrink-0 ${
                      index === activeSlideIndex
                        ? 'ring-2 ring-blue-500'
                        : 'hover:ring-2 hover:ring-gray-300'
                    } rounded-lg overflow-hidden transition-all`}
                  >
                    <img
                      src={slide}
                      alt={`Thumbnail ${index + 1}`}
                      className="h-16 w-auto object-contain"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">2. Record Your Speech</h2>
          <div className="border-2 rounded-lg p-6 text-center">
            {status === 'recording' ? (
              <button
                onClick={stopRecording}
                className="bg-red-500 text-white px-4 py-2 rounded-full hover:bg-red-600 transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <StopIcon className="h-5 w-5" />
                Stop Recording
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <MicrophoneIcon className="h-5 w-5" />
                Start Recording
              </button>
            )}
            {mediaBlobUrl && (
              <div className="mt-4">
                <audio src={mediaBlobUrl} controls className="mx-auto" />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="text-center">
        <button
          onClick={handleAnalysis}
          disabled={!presentationSlides.length || !mediaBlobUrl || isAnalyzing}
          className="bg-green-500 text-white px-6 py-3 rounded-full hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Presentation'}
        </button>
      </section>

      {feedback && (
        <section className="space-y-6 bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold">Feedback</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Emotional Analysis</h3>
              <p className="text-gray-600">
                Dominant Emotion: {feedback.emotionalAnalysis.dominant_emotion} 
                (Score: {(feedback.emotionalAnalysis.dominant_score * 100).toFixed(1)}%)
              </p>
              <div className="mt-2">
                <h4 className="font-medium">Detected Emotions:</h4>
                <ul className="list-disc list-inside text-gray-600">
                  {feedback.emotionalAnalysis.emotions.map((emotion, index) => (
                    <li key={index}>
                      {emotion.name}: {(emotion.score * 100).toFixed(1)}%
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium">Technical Metrics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-medium">Pacing</p>
                  <p className="text-gray-600">{feedback.technicalMetrics.pacing.score}/10</p>
                </div>
                <div>
                  <p className="font-medium">Clarity</p>
                  <p className="text-gray-600">{feedback.technicalMetrics.clarity}/10</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
