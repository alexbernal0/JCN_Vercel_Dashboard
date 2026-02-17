interface UnderConstructionProps {
  title: string;
  description: string;
  icon: string;
}

export function UnderConstruction({ title, description, icon }: UnderConstructionProps) {
  return (
    <div className="min-h-screen bg-white p-8 dark:bg-gray-950">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          {/* Icon */}
          <div className="mb-6 text-8xl">{icon}</div>
          
          {/* Title */}
          <h1 className="mb-4 text-4xl font-bold text-gray-900 dark:text-gray-50">
            {title}
          </h1>
          
          {/* Description */}
          <p className="mb-8 text-xl text-gray-600 dark:text-gray-400">
            {description}
          </p>
          
          {/* Under Construction Message */}
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-8 py-6 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              🚧 Under Construction 🚧
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This page is currently being built. Check back soon!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
