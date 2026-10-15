const categoryLabels: Readonly<Record<string, string>> = {
  Main: "Main Courses",
  Beverage: "Beverages",
  Dessert: "Desserts",
  Appetizer: "Starters",
  Snack: "Snacks",
};

// Translate display labels without changing stored categories or custom values.
export function menuCategoryLabel(category: string): string {
  return Object.hasOwn(categoryLabels, category) ? categoryLabels[category] : category;
}
