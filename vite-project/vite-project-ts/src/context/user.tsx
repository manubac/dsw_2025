import { createContext, useState, useContext, ReactNode, useEffect } from "react";

interface User {
  name: string;
  email: string;
  password?: string;
  role: "usuario" | "vendedor" | "admin";
}

interface UserContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (updated: Partial<User>) => void;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    //  restaurar el usuario si está en localStorage
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const login = (userData: User) => setUser(userData);

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const updateUser = (updated: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updated };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  return (
    <UserContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
