'use client'

import { useState, useRef } from 'react'
import { MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline'

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioURL, setAudioURL] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = async () => {
    try {
      setError(null)
      chunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioURL(url)
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
    } catch (err) {
      setError('Could not start recording: ' + err.message)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const analyzeRecording = async () => {
    try {
      setIsProcessing(true)
      setError(null)

      const response = await fetch(audioURL)
      const blob = await response.blob()

      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')

      const analysisResponse = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
      })

      if (!analysisResponse.ok) {
        throw new Error('Failed to analyze recording')
      }

      const data = await analysisResponse.json()
      setFeedback(data)
    } catch (err) {
      setError('Analysis failed: ' + err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const resetRecording = () => {
    setAudioURL(null)
    setFeedback(null)
    setError(null)
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
              <audio src={audioURL} controls className="w-full" />
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
