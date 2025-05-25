'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import dynamic from 'next/dynamic'
import { CloudArrowUpIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline'

// Dynamically import ReactMediaRecorder with no SSR
const ReactMediaRecorder = dynamic(
  () => import('react-media-recorder').then(mod => {
    // Ensure we're in a browser environment
    if (typeof window === 'undefined') {
      return { default: () => ({ status: 'idle', startRecording: () => {}, stopRecording: () => {}, mediaBlobUrl: null }) }
    }
    return { default: mod.useReactMediaRecorder }
  }),
  { 
    ssr: false,
    loading: () => <div>Loading media recorder...</div>
  }
)

export default function Home() {
  const [presentationSlides, setPresentationSlides] = useState([])
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isProcessingPDF, setIsProcessingPDF] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [mediaRecorderHook, setMediaRecorderHook] = useState(null)
  const [mediaError, setMediaError] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '/api'
  console.log('Backend URL:', BACKEND_URL)

  // Handle recording start
  const handleStartRecording = useCallback(async () => {
    console.log('Start recording clicked')
    if (!mediaRecorderHook) {
      console.error('Media recorder not initialized')
      setMediaError('Media recorder not initialized. Please refresh the page.')
      return
    }

    try {
      // Check microphone access again
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('Microphone access granted:', stream.active)
      
      // Start recording
      console.log('Starting recording...')
      setIsRecording(true)
      mediaRecorderHook.startRecording()
      
      // Add visual feedback
      const button = document.querySelector('.record-button')
      if (button) {
        button.classList.add('recording')
      }
    } catch (error) {
      console.error('Failed to start recording:', error)
      setMediaError(`Failed to start recording: ${error.message}`)
      setIsRecording(false)
    }
  }, [mediaRecorderHook])

  // Handle recording stop
  const handleStopRecording = useCallback(() => {
    console.log('Stop recording clicked')
    if (!mediaRecorderHook) {
      console.error('Media recorder not initialized')
      return
    }

    try {
      console.log('Stopping recording...')
      mediaRecorderHook.stopRecording()
      setIsRecording(false)
      
      // Remove visual feedback
      const button = document.querySelector('.record-button')
      if (button) {
        button.classList.remove('recording')
      }
    } catch (error) {
      console.error('Failed to stop recording:', error)
      setMediaError(`Failed to stop recording: ${error.message}`)
    }
  }, [mediaRecorderHook])

  // Initialize media recorder on client side only
  useEffect(() => {
    async function initializeMediaRecorder() {
      try {
        // First, check if browser supports getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Your browser does not support audio recording')
        }

        // Request audio permissions explicitly
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log('Audio permissions granted:', stream.active)
        
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop())

        // Initialize ReactMediaRecorder
        const { status, startRecording, stopRecording, mediaBlobUrl, error } = ReactMediaRecorder({
          audio: true,
          video: false,
          askPermissionOnMount: true,
          onStart: () => {
            console.log('Recording started')
            setIsRecording(true)
          },
          onStop: () => {
            console.log('Recording stopped')
            setIsRecording(false)
          },
          onError: (err) => {
            console.error('Media Recorder Error:', err)
            setMediaError(`Recording error: ${err.message || 'Unknown error'}`)
            setIsRecording(false)
          }
        })

        console.log('Media Recorder initialized:', { status, mediaBlobUrl, error })
        setMediaRecorderHook({ status, startRecording, stopRecording, mediaBlobUrl })
        setMediaError(null)
      } catch (error) {
        console.error('Media Recorder initialization failed:', error)
        setMediaError(`Could not initialize audio recording: ${error.message}`)
      }
    }

    initializeMediaRecorder()
  }, [])

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (!file) return

      setIsProcessingPDF(true)
      setUploadError(null)
      
      try {
        const formData = new FormData()
        formData.append('pdf', file)

        console.log('Sending PDF to backend...', BACKEND_URL)
        const response = await fetch(`${BACKEND_URL}/process-pdf`, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
          mode: 'cors',
          credentials: 'omit'
        })

        console.log('Response status:', response.status)
        console.log('Response headers:', Object.fromEntries([...response.headers]))
        
        if (!response.ok) {
          let errorMessage = 'Failed to process PDF'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch (e) {
            console.error('Error parsing error response:', e)
            errorMessage = `Server error: ${response.status} ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        const data = await response.json()
        console.log('Response data:', data)
        
        if (!data.slides || !Array.isArray(data.slides)) {
          throw new Error('Invalid response format from server')
        }

        console.log('PDF processed successfully, received', data.slides.length, 'slides')
        setPresentationSlides(data.slides)
        setActiveSlideIndex(0)
      } catch (error) {
        console.error('PDF processing failed:', error)
        if (!navigator.onLine) {
          setUploadError('You appear to be offline. Please check your internet connection.')
        } else if (error.message === 'Failed to fetch') {
          setUploadError(`Could not connect to the server at ${BACKEND_URL}. Please ensure:
1. The backend server is running
2. The server is accessible at ${BACKEND_URL}
3. CORS is properly configured`)
        } else {
          setUploadError(`Error: ${error.message}`)
        }
      } finally {
        setIsProcessingPDF(false)
      }
    }
  })

  const handleAnalysis = async () => {
    if (!presentationSlides.length || !mediaRecorderHook?.mediaBlobUrl) {
      alert('Please upload a presentation and record your speech first.')
      return
    }

    setIsAnalyzing(true)
    setUploadError(null)
    
    try {
      const audioBlob = await fetch(mediaRecorderHook.mediaBlobUrl).then(r => r.blob())
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' })

      const formData = new FormData()
      formData.append('audio', audioFile)
      formData.append('slide_content', `Slide ${activeSlideIndex + 1} of ${presentationSlides.length}`)

      const response = await fetch(`${BACKEND_URL}/analyze`, {
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
      setFeedback(data)
    } catch (error) {
      console.error('Analysis failed:', error)
      setUploadError(error.message.includes('Failed to fetch')
        ? 'Could not connect to the server. Please make sure the backend server is running.'
        : `Analysis failed: ${error.message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!mediaRecorderHook) {
    return <div>Loading media recorder...</div>
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
            {uploadError && (
              <p className="mt-2 text-red-500 text-sm">{uploadError}</p>
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
            {mediaError ? (
              <div className="text-red-500 mb-4">
                <p>{mediaError}</p>
                <p className="text-sm mt-2">Please ensure you have:</p>
                <ul className="text-sm list-disc list-inside">
                  <li>Allowed microphone access in your browser</li>
                  <li>Connected a working microphone</li>
                  <li>Not blocked audio permissions for this site</li>
                </ul>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 text-blue-500 underline"
                >
                  Refresh page to try again
                </button>
              </div>
            ) : !mediaRecorderHook ? (
              <div className="text-gray-500">
                <p>Initializing audio recorder...</p>
                <p className="text-sm mt-2">Please allow microphone access when prompted</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Status: {isRecording ? 'Recording...' : 'Ready to record'}
                  </div>
                  
                  {isRecording ? (
                    <button
                      onClick={handleStopRecording}
                      className="record-button bg-red-500 text-white px-6 py-3 rounded-full hover:bg-red-600 transition-colors flex items-center justify-center gap-2 mx-auto relative"
                    >
                      <StopIcon className="h-5 w-5" />
                      Stop Recording
                      <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full animate-pulse"></span>
                    </button>
                  ) : (
                    <button
                      onClick={handleStartRecording}
                      className="record-button bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                      <MicrophoneIcon className="h-5 w-5" />
                      Start Recording
                    </button>
                  )}
                </div>

                {mediaRecorderHook.mediaBlobUrl && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Your Recording:</p>
                    <audio 
                      src={mediaRecorderHook.mediaBlobUrl} 
                      controls 
                      className="mx-auto w-full"
                      onError={(e) => {
                        console.error('Audio playback error:', e)
                        setMediaError('Failed to play recording. Please try again.')
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="text-center">
        <button
          onClick={handleAnalysis}
          disabled={!presentationSlides.length || !mediaRecorderHook.mediaBlobUrl || isAnalyzing}
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
