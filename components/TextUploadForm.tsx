import React, { useState } from 'react';
import styles from '@/styles/UploadForm.module.css';

export default function TextUploadForm() {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ message?: string; analysis?: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      if (!text.trim()) {
        throw new Error('Please enter some text to process');
      }

      const response = await fetch('/api/processText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          title: title.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to process text');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Process Text with AI Understanding</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="title" className={styles.label}>
            Title (optional):
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.input}
            placeholder="Enter a title for this text"
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="text" className={styles.label}>
            Text Content:
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={styles.textarea}
            placeholder="Paste or type your text here..."
            rows={10}
            required
          />
        </div>

        <button
          type="submit"
          className={styles.button}
          disabled={isSubmitting || !text.trim()}
        >
          {isSubmitting ? 'Processing...' : 'Process Text'}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      {result && (
        <div className={styles.result}>
          <h3>Processing Result</h3>
          <p>{result.message}</p>
          {result.analysis && (
            <div className={styles.analysis}>
              <h4>Document Analysis</h4>
              <ul>
                <li><strong>Title:</strong> {result.analysis.title}</li>
                <li>
                  <strong>Topics:</strong>{' '}
                  {result.analysis.topics.join(', ')}
                </li>
                <li><strong>Content Type:</strong> {result.analysis.contentType}</li>
                <li><strong>Technical Level:</strong> {result.analysis.technicalLevel}/5</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 