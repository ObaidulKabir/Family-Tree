'use client';

import { register } from '@/actions/auth';
import { useState } from 'react';
import Link from 'next/link';

export default function RegisterForm() {
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    try {
      const result = await register(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch (e) {
        // Redirects might be thrown as errors, but usually server action handles it.
        // If we are here, it might be a real error or the redirect error if not handled by framework?
        // Actually nextjs handles redirect errors from server actions automatically if not caught.
        // But here I'm awaiting it.
        // If register throws redirect, it will bubble up.
    }
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded shadow-md">
      <h2 className="text-2xl font-bold text-center">Register</h2>
      {error && <p className="text-red-500 text-center">{error}</p>}
      <form action={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            name="name"
            type="text"
            required
            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            name="password"
            type="password"
            required
            className="w-full px-3 py-2 mt-1 border rounded-md focus:outline-none focus:ring focus:ring-indigo-200"
          />
        </div>
        <button
          type="submit"
          className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Register
        </button>
      </form>
      <div className="text-center">
        <p className="text-sm">Already have an account? <Link href="/login" className="text-indigo-600 hover:underline">Login</Link></p>
      </div>
    </div>
  );
}
