import '@/app/globals.css';
import { redirect } from 'next/navigation';

export default function TemplatePreviewIndex() {
  redirect('/dashboard/templates');
}
