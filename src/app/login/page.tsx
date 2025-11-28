import { Metadata } from 'next';
import LoginClient from './login-client';

export const metadata: Metadata = {
  title: 'Login - Access Your Dashboard | Baci',
  description: 'Log in to your Baci dashboard to manage your store, products, and orders. Secure access for business owners.',
};

export default function LoginPage() {
  return <LoginClient />;
}
