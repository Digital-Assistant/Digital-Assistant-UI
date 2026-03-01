/**
 * Imports the `getFromStore` utility function from the "../util" module.
 * Imports the `CONFIG` object from the "../config" module.
 */
import { getFromStore } from "../util";
import { CONFIG } from "../config";

/**
 * Retrieves the user's ID from the application's storage.
 * 
 * @returns {Promise<string | null>} The user's ID, or `null` if it could not be retrieved.
 * @throws {Error} If there was an error retrieving the user's ID.
 */
export const getUserId = async (): Promise<string | null> => {
    try {
        // Retrieve user session data from the store using the key defined in CONFIG.USER_AUTH_DATA_KEY
        const userSessionData = getFromStore(CONFIG.USER_AUTH_DATA_KEY, false);

        // Check if the userSessionData object exists, has an authData property, and the authData has an id property
        if (userSessionData && userSessionData.authData && userSessionData.authData.id) {
            // Return the user's ID from the authData object
            return userSessionData.authData.id;
        }

        // If the user's ID could not be found, return null
        return null;
    } catch (error) {
        // Log the error to the console
        console.log("Error retrieving user ID:", error);
        // Since this is async/promise based in usage, avoiding throw helps if we just want null
        return null;
    }
}
