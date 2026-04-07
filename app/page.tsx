// app/page.tsx — redireciona raiz para /workspace (ou login via middleware)
import { redirect } from 'next/navigation'
export default function RootPage() {
  redirect('/workspace')
}
