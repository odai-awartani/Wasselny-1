export const createRide = async (rideData: any) => {
    try {
        const response = await fetch("https://your-api-url.com/api/rides", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(rideData),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to create ride");
        }

        return await response.json();
    } catch (error) {
        console.error("Create Ride API error:", error);
        throw error;
    }
};
