'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [audioURL, setAudioURL] = useState('')
  const [error, setError] = useState(null)

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL)
      }
    }
  }, [audioURL])

  const startRecording = useCallback(async () => {
    try {
      setError(null)
      chunksRef.current = []

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Audio recording is not supported in this browser')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      })

      streamRef.current = stream
      const recorder = new MediaRecorder(stream)

      recorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      })

      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioURL(url)
        setIsRecording(false)
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
      })

      recorder.addEventListener('error', event => {
        console.error('MediaRecorder error:', event.error)
        setError(`Recording error: ${event.error.message || 'Unknown error'}`)
        setIsRecording(false)
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
      })

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError(`Could not start recording: ${err.message}`)
      setIsRecording(false)
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const stopRecording = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
    } catch (err) {
      console.error('Failed to stop recording:', err)
      setError(`Failed to stop recording: ${err.message}`)
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const resetRecording = useCallback(() => {
    setError(null)
    if (audioURL) {
      URL.revokeObjectURL(audioURL)
      setAudioURL('')
    }
  }, [audioURL])

  return {
    isRecording,
    audioURL,
    error,
    startRecording,
    stopRecording,
    resetRecording
  }
} 