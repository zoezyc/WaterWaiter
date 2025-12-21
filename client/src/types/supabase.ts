
export interface Profile {
    id: string; // UUID
    role: 'admin' | 'staff';
    full_name: string | null;
    created_at: string;
}

export interface DrinkType {
    id: string; // UUID
    name: string;
    description: string | null;
}

export interface Event {
    id: string; // UUID
    event_type: string;
    description: string | null;
    event_size: number | null;
    created_at: string;
}

export interface Robot {
    id: string; // UUID
    robot_name: string;
    status: 'idle' | 'moving' | 'offering' | 'returning' | 'error';
    manufacture_date: string | null;
    total_system_uptime: string | null; // Interval
    event_id: string | null; // FK to events
}

export interface DrinkInventory {
    id: string; // UUID
    drink_id: string; // FK to drink_types
    current_quantity: number;
    max_capacity: number;
    last_updated: string;
    updated_by: string | null; // FK to profiles
}

export interface EventDrink {
    id: string; // UUID
    event_id: string; // FK to events
    drink_id: string; // FK to drink_types
    max_quantity: number;
    created_at: string;
}

export interface InventoryRefillLog {
    id: string; // UUID
    drink_id: string; // FK to drink_types
    quantity_added: number;
    refill_time: string;
    refilled_by: string | null; // FK to profiles
    note: string | null;
}

export interface RobotEventInventory {
    id: string; // UUID
    robot_id: string; // FK to robot
    event_id: string; // FK to events
    drink_id: string; // FK to drink_types
    current_quantity: number;
    max_quantity: number;
    last_updated: string;
}
