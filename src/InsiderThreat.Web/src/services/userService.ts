import { api } from './api';
import type { User } from '../types';

export const userService = {
    // Get all users
    async getAllUsers(): Promise<User[]> {
        const response = await api.get<User[]>('/api/users');
        return response;
    }
};
