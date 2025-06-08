import { Dialog, DialogContent } from "@/components/ui/dialog";

interface RequestCooldownModalProps {
  isOpen: boolean;
  countdown: number;
  onClose: () => void;
}

export default function RequestCooldownModal({ isOpen, countdown, onClose }: RequestCooldownModalProps) {
  const progress = countdown > 0 ? ((60 - countdown) / 60) * 100 : 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md mx-auto bg-white dark:bg-gray-800 p-8">
        <div className="text-center space-y-6">
          {/* Circular Progress Timer */}
          <div className="relative w-32 h-32 mx-auto">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                className="text-gray-200 dark:text-gray-600"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="text-accent transition-all duration-1000 ease-linear"
                strokeLinecap="round"
              />
            </svg>
            {/* Timer text in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                  {countdown}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  seconds
                </div>
              </div>
            </div>
          </div>

          {/* Title and message */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Request Sent!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please wait {countdown} seconds before sending another request
            </p>
          </div>

          {/* Icon */}
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto">
            <i className="fas fa-check text-green-600 dark:text-green-400 text-2xl"></i>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}