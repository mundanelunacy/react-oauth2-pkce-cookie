import { useEffect, useState } from "react";

// useCookieStorage mirrors useBrowserStorage, but for cookies
export function useCookieStorage<T>(
    key: string,
    initialValue: T,
    prefix?: string,
    baseDomain?: string
): [T, (v: T) => void, () => void] {
    key = `${prefix ?? ""}${key}`;

    const getBaseDomain = (): string => {
        if (baseDomain) return baseDomain;

        const domainParts = window.location.hostname.split(".");
        return domainParts.length > 1
            ? `${domainParts[domainParts.length - 2]}.${domainParts[domainParts.length - 1]}`
            : domainParts[0];
    };

    const getCookie = (name: string): string | null => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(";").shift() ?? null;
        return null;
    };

    const deleteCookie = (name: string) => {
        document.cookie = `${name}=; path=/; domain=.${getBaseDomain()}; max-age=0`;
    };

    const [storedValue, setStoredValue] = useState<T>(() => {
        if (initialValue === undefined) {
            return initialValue;
        }

        const item = getCookie(key);
        try {
            return item ? JSON.parse(item) : initialValue;
        } catch (error: any) {
            console.warn(
                `Failed to parse stored value for '${key}'.\nContinuing with default value.\nError: ${error.message}`
            );
            return initialValue;
        }
    });

    const setValue = (value: T | ((val: T) => T)): void => {
        if (value === undefined) {
            setStoredValue(value as any);
            deleteCookie(key);
            return;
        }
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);

            const cookieString = `${key}=${JSON.stringify(
                valueToStore
            )};path=/;domain=.${getBaseDomain()};max-age=31536000`; // Store for a year

            document.cookie = cookieString;
        } catch (_error) {
            console.log(`Failed to store value '${value}' for key '${key}'`);
        }
    };

    const refreshValue = () => {
        const item = getCookie(key);
        try {
            setStoredValue(item ? JSON.parse(item) : initialValue);
        } catch (error: any) {
            console.warn(
                `Failed to parse stored value for '${key}'.\nContinuing with default value.\nError: ${error.message}`
            );
        }
    };

    // To support changes on multi-domain cookies, we resort to polling
    // In the future, change this to CookieStore API which supports Cookie Change Events
    // This is unsupported by Safari and IE11 though, so we need to keep polling for those
    // https://stackoverflow.com/questions/14344319/can-i-be-notified-of-cookie-changes-in-client-side-javascript

    useEffect(() => {
        const checkInterval = 1000; // check every second
        let lastCookieValue = getCookie(key);

        function checkForCookieChange() {
            const currentCookieValue = getCookie(key);
            if (lastCookieValue !== currentCookieValue) {
                lastCookieValue = currentCookieValue;
                try {
                    setStoredValue(currentCookieValue ? JSON.parse(currentCookieValue) : initialValue);
                } catch (error: any) {
                    console.warn(
                        `Failed to parse stored value for '${key}' due to cookie change.\nContinuing with default value.\nError: ${error.message}`
                    );
                }
            }
        }

        const intervalId = setInterval(checkForCookieChange, checkInterval);
        return () => clearInterval(intervalId); // cleanup on unmount
    }, [key, initialValue]);

    return [storedValue, setValue, refreshValue];
}
