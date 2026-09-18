"use server";

import {
  createLostFoundItem as createItem,
  markLostFoundItemReturned as returnItem,
} from "@/lib/lost-found/actions";

// Keep native <form action> consumers compatible. New feedback UIs should use
// the typed canonical actions from @/lib/lost-found/actions directly.
export async function createLostFoundItem(formData: FormData): Promise<void> {
  await createItem(formData);
}

export async function markLostFoundItemReturned(formData: FormData): Promise<void> {
  await returnItem(formData);
}
