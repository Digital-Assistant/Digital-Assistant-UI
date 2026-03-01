import { toast } from "sonner";
import { ExternalToast } from "sonner";

/**
 *
 * @param title
 * @param description
 * @param status
 * @param placement
 */
export const addNotification = (title = '', description = '', status: 'success' | 'info' | 'warning' | 'error' = 'info', placement = 'top') => {
    // Map antd status to sonner 
    // Sonner usage: toast.success(title, { description: description })

    const options: ExternalToast = {
        description: description,
    };

    if (status === 'success') {
        toast.success(title, options);
    } else if (status === 'error') {
        toast.error(title, options);
    } else if (status === 'warning') {
        toast.warning(title, options);
    } else {
        toast.info(title, options);
    }
}
