const categoryLabels: Readonly<Record<string, string>> = {
  Main: "Hidangan Utama",
  Beverage: "Minuman",
  Dessert: "Hidangan Penutup",
  Appetizer: "Hidangan Pembuka",
  Snack: "Camilan",
};

// Translate display labels without changing stored categories or custom values.
export function menuCategoryLabel(category: string): string {
  return Object.hasOwn(categoryLabels, category) ? categoryLabels[category] : category;
}
