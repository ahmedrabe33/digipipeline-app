import { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('accessToken');

        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, []);

    const extractUser = (responseData) => {
        return (
            responseData?.user ||
            responseData?.data?.user ||
            responseData?.data ||
            null
        );
    };

    const extractToken = (responseData) => {
        return (
            responseData?.accessToken ||
            responseData?.token ||
            responseData?.data?.accessToken ||
            responseData?.data?.token ||
            null
        );
    };

    const extractRefreshToken = (responseData, fallbackToken) => {
        return (
            responseData?.refreshToken ||
            responseData?.data?.refreshToken ||
            fallbackToken ||
            null
        );
    };

    const fetchUser = async () => {
        try {
            const response = await authAPI.me();
            const currentUser = extractUser(response.data);

            if (!currentUser) {
                throw new Error('No user returned from /me');
            }

            setUser(currentUser);
        } catch (error) {
            console.error('Failed to fetch user:', error);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const response = await authAPI.login({ email, password });

        const accessToken = extractToken(response.data);
        const refreshToken = extractRefreshToken(response.data, accessToken);
        const loggedInUser = extractUser(response.data);

        if (!accessToken) {
            throw new Error('Login succeeded but no token returned');
        }

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);

        setUser(loggedInUser);

        return loggedInUser;
    };

    const signup = async (email, password, firstName, lastName) => {
        const response = await authAPI.signup({
            email,
            password,
            firstName,
            lastName
        });

        const accessToken = extractToken(response.data);
        const refreshToken = extractRefreshToken(response.data, accessToken);
        const signedUpUser = extractUser(response.data);

        if (accessToken) {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            setUser(signedUpUser);
        }

        return signedUpUser;
    };

    const logout = async () => {
        try {
            const refreshToken = localStorage.getItem('refreshToken');

            if (refreshToken && authAPI.logout) {
                await authAPI.logout(refreshToken);
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setUser(null);
        }
    };

    const value = {
        user,
        loading,
        login,
        signup,
        logout,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }

    return context;
};