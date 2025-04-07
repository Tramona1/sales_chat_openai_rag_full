import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { FeedbackLog } from '@/types/feedback';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { user, query, response } = req.body;
    
    if (!query || !response) {
      return res.status(400).json({ message: 'Missing required log data' });
    }
    
    const logData: FeedbackLog = {
      sender: user || 'Anonymous',
      text: query,
      response: response,
      timestamp: Date.now()
    };
    
    const filePath = path.join(process.cwd(), 'feedback.json');
    
    // Read existing logs or initialize empty array
    let logs: FeedbackLog[] = [];
    if (fs.existsSync(filePath)) {
      try {
        const fileData = fs.readFileSync(filePath, 'utf-8');
        logs = JSON.parse(fileData);
        if (!Array.isArray(logs)) logs = [];
      } catch (error) {
        console.error('Error parsing logs file:', error);
        logs = [];
      }
    }
    
    // Add new log
    logs.push(logData);
    
    // Write updated logs
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
    
    return res.status(200).json({ status: 'logged' });
  } catch (error) {
    console.error('Error logging feedback:', error);
    return res.status(500).json({ 
      message: 'Failed to log feedback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 