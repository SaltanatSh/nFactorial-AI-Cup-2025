'use client'

import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useReactMediaRecorder } from 'react-media-recorder'
import { CloudArrowUpIcon, MicrophoneIcon, StopIcon } from '@heroicons/react/24/outline'

export default function Home() {
  const [presentationImage, setPresentationImage] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const { status, startRecording, stopRecording, mediaBlobUrl } = useReactMediaRecorder({
    audio: true,
    video: false,
  })

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      setPresentationImage(Object.assign(file, {
        preview: URL.createObjectURL(file)
      }))
    }
  })

  const handleAnalysis = async () => {
    if (!presentationImage || !mediaBlobUrl) {
      alert('Please upload a presentation slide and record your speech first.')
      return
    }

    setIsAnalyzing(true)
    try {
      // Here we'll implement the AI analysis logic later
      const mockFeedback = {
        slideAnalysis: "Your slide appears well-structured with clear headings.",
        speechAnalysis: "Good pace and clarity in your speech. Consider varying your tone more.",
        improvements: [
          "Add more pauses for emphasis",
          "Use more engaging visuals",
          "Include key statistics to support your points"
        ]
      }
      setFeedback(mockFeedback)
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
          <h2 className="text-xl font-semibold">1. Upload Your Presentation Slide</h2>
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2">Drag & drop a slide image here, or click to select</p>
          </div>
          {presentationImage && (
            <div className="mt-4">
              <img
                src={presentationImage.preview}
                alt="Uploaded slide"
                className="max-h-48 mx-auto rounded-lg shadow-md"
              />
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
          disabled={!presentationImage || !mediaBlobUrl || isAnalyzing}
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
              <h3 className="text-lg font-medium">Slide Analysis</h3>
              <p className="text-gray-600">{feedback.slideAnalysis}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium">Speech Analysis</h3>
              <p className="text-gray-600">{feedback.speechAnalysis}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium">Suggested Improvements</h3>
              <ul className="list-disc list-inside text-gray-600">
                {feedback.improvements.map((improvement, index) => (
                  <li key={index}>{improvement}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
