export interface SavedLogin { loginURL: string; successURL: string; username: string; password: string; remember: boolean }
export interface LoginSummary { configured: boolean; secureStorage: boolean; loginURL?: string; successURL?: string; username?: string; remembered?: boolean }
