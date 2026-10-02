/** "Only 3 left" when stock is low; nothing otherwise. */
export function StockNote({ stock, className = "" }: { stock: number; className?: string }) {
  if (stock <= 0) return <span className={`font-semibold text-alert ${className}`}>Sold out</span>;
  if (stock > 3) return null;
  return <span className={`font-semibold text-pit ${className}`}>Only {stock} left</span>;
}
