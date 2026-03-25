export const LoadingScreen = () => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-cittaa-200 border-t-cittaa-700 rounded-full animate-spin mb-4" />
        <p className="text-app text-lg font-medium">Loading...</p>
      </div>
    </div>
  )
}

export default LoadingScreen
