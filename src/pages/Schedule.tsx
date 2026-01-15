import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type ScheduledWorkout, type WorkoutTemplate, type TemplateExercise } from '../db';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { X, FileText, ChevronRight, Check, MoreVertical } from 'lucide-react';

export const Schedule: React.FC = () => {
    const navigate = useNavigate();
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Get next 7 days
    const days = useMemo(() => {
        const today = startOfDay(new Date());
        return Array.from({ length: 7 }, (_, i) => addDays(today, i));
    }, []);

    // Get all scheduled workouts for the next 7 days
    const scheduledWorkouts = useLiveQuery(async () => {
        const dateStrings = days.map(d => format(d, 'yyyy-MM-dd'));
        return db.scheduledWorkouts
            .where('date')
            .anyOf(dateStrings)
            .toArray();
    }, [days]);

    // Get all templates
    const templates = useLiveQuery(() => db.templates.toArray());

    const getScheduledForDay = (date: Date): ScheduledWorkout[] => {
        const dateStr = format(date, 'yyyy-MM-dd');
        // Filter out old scheduled workouts without exercises (legacy data)
        return scheduledWorkouts?.filter(s => s.date === dateStr && s.exercises && s.exercises.length > 0) || [];
    };

    const handleDayClick = (date: Date) => {
        setSelectedDate(date);
        setIsModalOpen(true);
    };

    const handleScheduledClick = (scheduledId: number) => {
        navigate(`/schedule/${scheduledId}`);
    };

    const today = startOfDay(new Date());

    return (
        <div className="space-y-4 pb-8">
            <h1 className="text-2xl font-bold">Schedule</h1>

            {/* 7-Day Calendar */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((day, idx) => {
                    const isToday = isSameDay(day, today);
                    const scheduledForDay = getScheduledForDay(day);
                    const hasScheduled = scheduledForDay.length > 0;

                    return (
                        <button
                            key={idx}
                            onClick={() => handleDayClick(day)}
                            className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl min-w-[70px] transition-all ${isToday
                                ? 'bg-blue-600 text-white'
                                : hasScheduled
                                    ? 'bg-green-900/30 border border-green-800'
                                    : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700'
                                }`}
                        >
                            <span className="text-xs uppercase tracking-wider opacity-70">
                                {format(day, 'EEE')}
                            </span>
                            <span className="text-2xl font-bold">{format(day, 'd')}</span>
                            {hasScheduled && (
                                <div className="w-2 h-2 bg-green-500 rounded-full mt-1"></div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Scheduled Workouts List */}
            <div className="space-y-4">
                {days.map((day, idx) => {
                    const scheduledForDay = getScheduledForDay(day);
                    if (scheduledForDay.length === 0) return null;

                    const isToday = isSameDay(day, today);

                    return (
                        <div key={idx} className="space-y-2">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                {isToday ? 'Today' : format(day, 'EEEE, MMM d')}
                            </h3>

                            {scheduledForDay.map(scheduled => (
                                <button
                                    key={scheduled.id}
                                    onClick={() => handleScheduledClick(scheduled.id!)}
                                    className={`w-full bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex justify-between items-center text-left hover:border-zinc-700 transition-colors ${scheduled.completed ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-lg">{scheduled.templateName}</h4>
                                            {scheduled.completed && (
                                                <span className="text-green-500"><Check size={16} /></span>
                                            )}
                                        </div>
                                        {scheduled.notes && (
                                            <p className="text-sm text-zinc-500 flex items-center gap-1 mt-1 truncate">
                                                <FileText size={12} />
                                                {scheduled.notes}
                                            </p>
                                        )}
                                        <p className="text-xs text-zinc-600 mt-1">
                                            {scheduled.exercises?.length || 0} exercises
                                        </p>
                                    </div>
                                    <ChevronRight size={20} className="text-zinc-500" />
                                </button>
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* Empty State */}
            {(!scheduledWorkouts || scheduledWorkouts.filter(s => s.exercises && s.exercises.length > 0).length === 0) && (
                <div className="text-center py-8">
                    <p className="text-zinc-500 mb-4">No workouts scheduled</p>
                    <p className="text-zinc-600 text-sm">Tap a day above to schedule a workout</p>
                </div>
            )}

            {/* Schedule Modal */}
            {isModalOpen && selectedDate && (
                <ScheduleModal
                    date={selectedDate}
                    templates={templates || []}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </div>
    );
};

// Modal for scheduling a workout
interface ScheduleModalProps {
    date: Date;
    templates: WorkoutTemplate[];
    onClose: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ date, templates, onClose }) => {
    const navigate = useNavigate();
    const dateStr = format(date, 'yyyy-MM-dd');

    const handleCustomize = (templateId: number) => {
        onClose();
        navigate(`/schedule/customize/${templateId}?date=${dateStr}`);
    };

    const handleQuickSchedule = async (template: WorkoutTemplate) => {
        // Quick schedule without customization
        const exercisesCopy: TemplateExercise[] = JSON.parse(JSON.stringify(template.exercises));

        await db.scheduledWorkouts.add({
            templateId: Number(template.id),
            templateName: template.name,
            date: dateStr,
            exercises: exercisesCopy,
            completed: false
        });

        onClose();
        navigate('/schedule');
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-50 p-4 overflow-y-auto">
            <div className="max-w-lg mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">
                        Schedule for {format(date, 'EEEE, MMM d')}
                    </h2>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {templates.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-zinc-500 mb-4">No templates yet</p>
                        <p className="text-zinc-600 text-sm">Create a template first to schedule workouts</p>
                    </div>
                ) : (
                    <>
                        <p className="text-zinc-500 text-sm mb-3">Select a template:</p>
                        <div className="space-y-2">
                            {templates.map(template => (
                                <div
                                    key={template.id}
                                    className="bg-zinc-900 rounded-xl border border-zinc-800 flex items-center overflow-hidden"
                                >
                                    <button
                                        onClick={() => handleQuickSchedule(template)}
                                        className="flex-1 p-4 text-left hover:bg-zinc-800/50"
                                    >
                                        <span className="font-bold">{template.name}</span>
                                        <span className="text-sm text-zinc-500 ml-2">
                                            {template.exercises.length} exercises
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => handleCustomize(Number(template.id))}
                                        className="p-4 text-zinc-500 hover:text-white hover:bg-zinc-800/50 border-l border-zinc-800"
                                        title="Customize sets & reps"
                                    >
                                        <MoreVertical size={20} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-zinc-600 text-center mt-4">
                            Tap template to quick schedule, or tap ⋮ to customize sets & reps
                        </p>
                    </>
                )}
            </div>
        </div>
    );
};
