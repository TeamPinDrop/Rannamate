import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pb-20 pt-40 text-center">
      <p className="text-7xl">🍳</p>
      <h1 className="h-display mt-4 text-4xl text-forest">This page burnt.</h1>
      <Link href="/" className="btn-primary mt-6">Back home</Link>
    </div>
  );
}
