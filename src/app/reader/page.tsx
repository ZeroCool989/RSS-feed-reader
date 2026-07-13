import { Suspense } from "react";
import type { Metadata } from "next";
import ReaderApp from "@/components/ReaderApp";

export const metadata: Metadata = { title: "Reader" };

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
      <ReaderApp />
    </Suspense>
  );
}
