import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio')

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Convert the audio file to a Buffer
    const buffer = Buffer.from(await audioFile.arrayBuffer())

    // Create a temporary file with the audio data
    const audioResponse = await openai.audio.transcriptions.create({
      file: {
        buffer,
        name: 'recording.webm'
      },
      model: 'whisper-1',
    })

    // Get the transcription
    const transcription = audioResponse.text

    // Analyze the speech using GPT-4
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional public speaking coach. Analyze the following speech transcription and provide constructive feedback. Focus on:
          1. Clarity and articulation
          2. Pacing and rhythm
          3. Use of filler words
          4. Overall delivery
          5. Specific suggestions for improvement
          
          Keep the feedback concise, constructive, and actionable.`
        },
        {
          role: 'user',
          content: transcription
        }
      ]
    })

    const feedback = completion.choices[0].message.content

    return NextResponse.json({
      transcription,
      feedback
    })
  } catch (error) {
    console.error('Error processing audio:', error)
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    )
  }
} 