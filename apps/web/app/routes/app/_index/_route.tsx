import { notFound } from "@/utils/http";

export function loader() {
  throw notFound();
}

export default function NotFound() {
  return null;
}
