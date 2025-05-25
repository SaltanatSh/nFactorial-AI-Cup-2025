'use client'

import { useState, useRef, useEffect } from 'react'
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioURL, setAudioURL] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioChunksRef = useRef([])

  // Cleanup function
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL)
      }
    }
  }, [audioURL])

  const startRecording = async () => {
    try {
      // Reset state
      setError(null)
      setAudioBlob(null)
      setAudioURL(null)
      setFeedback(null)
      audioChunksRef.current = []

      console.log('Requesting microphone access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 44100
        }
      })

      mediaStreamRef.current = stream
      console.log('Microphone access granted')

      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioURL(url)
        setIsRecording(false)

        // Stop the stream
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop())
        }
      }

      recorder.onerror = (event) => {
        console.error('Recording error:', event.error)
        setError('Recording error: ' + (event.error.message || 'Unknown error'))
        setIsRecording(false)

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop())
        }
      }

      // Start recording
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      console.log('Recording started')

    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Could not start recording: ' + err.message)
      setIsRecording(false)

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }

  const stopRecording = () => {
    console.log('Stopping recording...')
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      console.log('Recording stopped')
    }
  }

  const analyzeRecording = async () => {
    if (!audioBlob) {
      setError('No recording to analyze')
      return
    }

    try {
      setIsProcessing(true)
      setError(null)

      console.log('Sending recording for analysis...')
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to analyze recording')
      }

      const data = await response.json()
      setFeedback(data)
      console.log('Analysis complete')
    } catch (err) {
      console.error('Analysis failed:', err)
      setError('Analysis failed: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const resetRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
    }
    setAudioBlob(null)
    setAudioURL(null)
    setFeedback(null)
    setError(null)
    audioChunksRef.current = []
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">Speech Analyzer</h1>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
            <p>{error}</p>
            <button 
              onClick={resetRecording}
              className="text-sm text-red-600 underline mt-2"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex justify-center">
            {isRecording ? (
              <button
                onClick={stopRecording}
                className="bg-red-500 text-white px-6 py-3 rounded-full hover:bg-red-600 transition-colors flex items-center space-x-2"
              >
                <StopIcon className="h-6 w-6" />
                <span>Stop Recording</span>
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={isProcessing}
                className="bg-blue-500 text-white px-6 py-3 rounded-full hover:bg-blue-600 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <MicrophoneIcon className="h-6 w-6" />
                <span>Start Recording</span>
              </button>
            )}
          </div>

          {audioURL && !isRecording && (
            <div className="space-y-4">
              <audio 
                src={audioURL} 
                controls 
                className="w-full"
                controlsList="nodownload"
              />
              <button
                onClick={analyzeRecording}
                disabled={isProcessing}
                className="w-full bg-green-500 text-white py-2 px-4 rounded-full hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Analyzing...' : 'Analyze Recording'}
              </button>
            </div>
          )}

          {feedback && (
            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
              <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-gray-700">Transcription:</h3>
                  <p className="mt-1 text-gray-600">{feedback.transcription}</p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-700">Feedback:</h3>
                  <div className="mt-1 text-gray-600 whitespace-pre-wrap">
                    {feedback.feedback}
                  </div>
                </div>
              </div>

              <button
                onClick={resetRecording}
                className="mt-6 text-blue-500 underline"
              >
                Record Another
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
