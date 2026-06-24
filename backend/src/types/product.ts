export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  created_at: Date;
  updated_at: Date;
}

export interface Cursor {
  updatedAt: string; // ISO string
  id: string;        // UUID
}

export interface PaginationParams {
  limit: number;
  category?: string;
  cursor?: string;    // Base64 encoded JSON string of Cursor
  snapshot?: string;  // ISO string representing the snapshot timestamp
}

export interface PaginatedResponse {
  data: Product[];
  pagination: {
    nextCursor: string | null;
    snapshot: string;
    hasMore: boolean;
  };
}
