
export interface Profile {
    id: string; // UUID
    role: 'admin' | 'staff' | 'client';
    full_name: string | null;
    created_at: string;
}

export interface DrinkList {
    id: string; // UUID
    name: string;
    created_by: string | null; // FK to profiles
    created_at: string;
}

export interface Drink {
    id: string; // UUID
    drink_list_id: string; // FK to drink_list
    name: string;
    type: string | null;
    volume: number | null;
    default_quantity: number;
    unit: string | null; // e.g., 'ml', 'oz'
    created_at: string;
}

export interface Event {
    id: string; // UUID
    name: string;
    description: string | null;
    event_type: string | null;
    event_date: string; // date
    start_time: string | null; // time
    end_time: string | null; // time
    location: string | null;
    drink_list_id: string; // FK to drink_list
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
    created_at: string;
}

export interface Robot {
    id: string; // UUID
    robot_name: string;
    serial_number: string | null;
    status: 'idle' | 'moving' | 'offering' | 'returning' | 'error' | null;
    created_at: string;
}

export interface EventRobot {
    id: string; // UUID
    event_id: string; // FK to events
    robot_id: string; // FK to robots
    assigned_at: string;
}

export interface EventDrink {
    id: string; // UUID
    event_id: string; // FK to events
    drink_id: string; // FK to drinks
    initial_quantity: number;
    current_quantity: number;
    created_at: string;
    updated_at: string;
}

export interface RobotDrinkStock {
    id: string; // UUID
    robot_id: string; // FK to robots
    event_id: string; // FK to events
    drink_id: string; // FK to drinks
    quantity: number;
    max_quantity: number;
    last_updated: string;
    updated_at: string;
}

export interface ActivityLog {
    id: string; // UUID
    event_id: string; // FK to events
    robot_id: string; // FK to robots
    drink_id: string; // FK to drinks
    user_id: string | null; // FK to profiles
    action: 'take' | 'refill';
    quantity_changed: number;
    timestamp: string;
}

export interface Notification {
    id: string; // UUID
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
}
