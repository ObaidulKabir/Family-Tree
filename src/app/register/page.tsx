import RegisterForm from '@/components/auth/RegisterForm';
import { Suspense } from 'react';

export default function RegisterPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Suspense fallback={<div>Loading...</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
