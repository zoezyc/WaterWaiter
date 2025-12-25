import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Coffee } from 'lucide-react';
import { supabase } from '../services/supabase';

interface DrinkStat {
    drink_name: string;
    count: number;
}

interface DrinkListStat {
    drink_list_name: string;
    count: number;
}

interface EventTypeStat {
    event_type: string;
    drinks: DrinkStat[];
}

interface AgeGroupStat {
    age_range: string;
    drinks: DrinkStat[];
}

const AnalyticsPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [overallStats, setOverallStats] = useState<DrinkStat[]>([]);
    const [eventTypeStats, setEventTypeStats] = useState<EventTypeStat[]>([]);
    const [ageGroupStats, setAgeGroupStats] = useState<AgeGroupStat[]>([]);
    const [drinkListStats, setDrinkListStats] = useState<DrinkListStat[]>([]);
    const [totalServed, setTotalServed] = useState(0);
    const [totalEvents, setTotalEvents] = useState(0);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        if (!supabase) return;
        setLoading(true);

        try {
            // Fetch all 'take' actions with event and drink data
            const { data: logs, error } = await supabase
                .from('activity_log')
                .select(`
                    *,
                    drinks(name, drink_list:drink_list_id(name)),
                    events(name, event_type, min_age, max_age)
                `)
                .eq('action', 'take');

            if (error) throw error;

            if (logs) {
                // Calculate overall statistics
                const drinkCounts: Record<string, number> = {};
                const eventTypes = new Set<string>();

                logs.forEach((log: any) => {
                    const drinkName = log.drinks?.name || 'Unknown';
                    drinkCounts[drinkName] = (drinkCounts[drinkName] || 0) + log.quantity_changed;
                    if (log.events?.event_type) eventTypes.add(log.events.event_type);
                });

                const overall = Object.entries(drinkCounts)
                    .map(([drink_name, count]) => ({ drink_name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5);

                setOverallStats(overall);
                setTotalServed(Object.values(drinkCounts).reduce((sum, count) => sum + count, 0));
                setTotalEvents(eventTypes.size);

                // Calculate by event type
                const byEventType: Record<string, Record<string, number>> = {};
                logs.forEach((log: any) => {
                    const eventType = log.events?.event_type || 'Unknown';
                    const drinkName = log.drinks?.name || 'Unknown';

                    if (!byEventType[eventType]) byEventType[eventType] = {};
                    byEventType[eventType][drinkName] =
                        (byEventType[eventType][drinkName] || 0) + log.quantity_changed;
                });

                const eventTypesData = Object.entries(byEventType).map(([event_type, drinks]) => ({
                    event_type,
                    drinks: Object.entries(drinks)
                        .map(([drink_name, count]) => ({ drink_name, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 3)
                }));

                setEventTypeStats(eventTypesData);

                // Calculate by age group
                const byAgeGroup: Record<string, Record<string, number>> = {};
                logs.forEach((log: any) => {
                    const minAge = log.events?.min_age || 0;
                    let ageRange = '41+';

                    if (minAge < 18) ageRange = '0-17';
                    else if (minAge >= 18 && minAge <= 25) ageRange = '18-25';
                    else if (minAge >= 26 && minAge <= 40) ageRange = '26-40';

                    const drinkName = log.drinks?.name || 'Unknown';

                    if (!byAgeGroup[ageRange]) byAgeGroup[ageRange] = {};
                    byAgeGroup[ageRange][drinkName] =
                        (byAgeGroup[ageRange][drinkName] || 0) + log.quantity_changed;
                });

                const ageGroupsData = Object.entries(byAgeGroup).map(([age_range, drinks]) => ({
                    age_range,
                    drinks: Object.entries(drinks)
                        .map(([drink_name, count]) => ({ drink_name, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 3)
                })).sort((a, b) => {
                    const order = ['0-17', '18-25', '26-40', '41+'];
                    return order.indexOf(a.age_range) - order.indexOf(b.age_range);
                });

                setAgeGroupStats(ageGroupsData);

                // Calculate by drink list
                const byDrinkList: Record<string, number> = {};
                logs.forEach((log: any) => {
                    const drinkListName = log.drinks?.drink_list?.name || 'Unknown';
                    byDrinkList[drinkListName] = (byDrinkList[drinkListName] || 0) + log.quantity_changed;
                });

                const drinkListData = Object.entries(byDrinkList)
                    .map(([drink_list_name, count]) => ({ drink_list_name, count }))
                    .sort((a, b) => b.count - a.count);

                setDrinkListStats(drinkListData);
            }
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getBarWidth = (count: number, maxCount: number) => {
        return `${(count / maxCount) * 100}%`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <h2 className="text-2xl font-bold flex items-center space-x-2">
                    <BarChart3 size={28} />
                    <span>Analytics Dashboard</span>
                </h2>
                <p className="text-gray-400 mt-1">Drink consumption insights and statistics</p>
            </div>

            {loading ? (
                <div className="text-center p-12 text-gray-500">Loading analytics...</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-purple-900/50 to-gray-800 p-6 rounded-xl border border-purple-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm">Total Drinks Served</p>
                                    <p className="text-3xl font-bold mt-1">{totalServed}</p>
                                </div>
                                <TrendingUp size={40} className="text-purple-400" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-900/50 to-gray-800 p-6 rounded-xl border border-blue-700">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-400 text-sm">Event Types</p>
                                    <p className="text-3xl font-bold mt-1">{totalEvents}</p>
                                </div>
                                <Calendar size={40} className="text-blue-400" />
                            </div>
                        </div>
                    </div>

                    {/* Overall Top Drinks */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                            <TrendingUp size={24} className="text-yellow-400" />
                            <span>Top 5 Most Popular Drinks (Overall)</span>
                        </h3>
                        {overallStats.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No data available</p>
                        ) : (
                            <div className="space-y-3">
                                {overallStats.map((stat, index) => {
                                    const maxCount = overallStats[0].count;
                                    return (
                                        <div key={stat.drink_name} className="flex items-center space-x-3">
                                            <span className="text-2xl font-bold text-purple-400 w-8">
                                                #{index + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-medium">{stat.drink_name}</span>
                                                    <span className="text-gray-400">{stat.count} servings</span>
                                                </div>
                                                <div className="w-full bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                                                        style={{ width: getBarWidth(stat.count, maxCount) }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* By Event Type */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                            <Calendar size={24} className="text-blue-400" />
                            <span>Popular Drinks by Event Type</span>
                        </h3>
                        {eventTypeStats.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No data available</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {eventTypeStats.map((eventStat) => (
                                    <div key={eventStat.event_type} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                        <h4 className="font-bold text-lg mb-3 text-blue-400 capitalize">
                                            {eventStat.event_type}
                                        </h4>
                                        <div className="space-y-2">
                                            {eventStat.drinks.map((drink, index) => (
                                                <div key={drink.drink_name} className="flex justify-between items-center">
                                                    <span className="text-sm">
                                                        {index + 1}. {drink.drink_name}
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-400">
                                                        {drink.count}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* By Drink List */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                            <Coffee size={24} className="text-orange-400" />
                            <span>Popular Drink Lists</span>
                        </h3>
                        {drinkListStats.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No data available</p>
                        ) : (
                            <div className="space-y-3">
                                {drinkListStats.map((stat, index) => {
                                    const maxCount = drinkListStats[0].count;
                                    return (
                                        <div key={stat.drink_list_name} className="flex items-center space-x-3">
                                            <span className="text-xl font-bold text-orange-400 w-8">
                                                #{index + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-medium">{stat.drink_list_name}</span>
                                                    <span className="text-gray-400">{stat.count} servings</span>
                                                </div>
                                                <div className="w-full bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full transition-all"
                                                        style={{ width: getBarWidth(stat.count, maxCount) }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* By Age Group */}
                    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                        <h3 className="text-xl font-bold mb-4 flex items-center space-x-2">
                            <Users size={24} className="text-green-400" />
                            <span>Popular Drinks by Age Group</span>
                        </h3>
                        {ageGroupStats.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No data available</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {ageGroupStats.map((ageStat) => (
                                    <div key={ageStat.age_range} className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                                        <h4 className="font-bold text-lg mb-3 text-green-400">
                                            Ages {ageStat.age_range}
                                        </h4>
                                        <div className="space-y-2">
                                            {ageStat.drinks.map((drink, index) => (
                                                <div key={drink.drink_name} className="flex justify-between items-center">
                                                    <span className="text-sm">
                                                        {index + 1}. {drink.drink_name}
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-400">
                                                        {drink.count}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default AnalyticsPage;
