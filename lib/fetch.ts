
import { useState, useEffect, useCallback } from "react";

export const fetchAPI = async (url: string, options?: RequestInit) => {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Fetch error:", error);
    throw error;
  }
};

export const useFetch = <T>(url: string, options?: RequestInit) => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    const fetchData = useCallback(async () => {
      setLoading(true);
      setError(null);
  
      try {
        const result = await fetchAPI(url, options);
        setData(result.data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }, [url, options]);
  
    useEffect(() => {
      fetchData();
    }, [fetchData]);
  
    return { data, loading, error, refetch: fetchData };
  };

  export const fetchSuggestedRides = async (userId: string, location: { lat: number; lon: number }) => {
    const res = await fetch(`/api/ride/suggested?user=${userId}&lat=${location.lat}&lon=${location.lon}`);
    
    if (!res.ok) {
        throw new Error(`فشل جلب البيانات، الحالة: ${res.status}`);
    }

    return await res.json();
};

// lib/api.ts

export async function fetchDriverDataByUserId(userId: string) {
  try {
    const response = await fetch(`/api/driver+api/${userId}`);
    if (response.ok) {
      const data = await response.json();
      return data; // سترجع البيانات الخاصة بالسائق إذا كانت موجودة
    } else {
      return null; // لا توجد بيانات سائق لهذا المستخدم
    }
  } catch (error) {
    console.error('Error fetching driver data:', error);
    return null; // إذا حدث خطأ في جلب البيانات
  }
}

// lib/driver.ts
export const fetchDriverStatus = async (userId: string) => {
  const response = await fetch("/(api)/driver/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!response.ok) {
    throw new Error("فشل في التحقق من حالة السائق");
  }

  return await response.json();
};

