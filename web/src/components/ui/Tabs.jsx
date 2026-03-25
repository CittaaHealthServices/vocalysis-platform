import { useState } from 'react'
import clsx from 'clsx'

export const Tabs = ({ tabs, defaultTab = 0, onTabChange }) => {
  const [activeTab, setActiveTab] = useState(defaultTab)

  const handleTabChange = (index) => {
    setActiveTab(index)
    onTabChange?.(index)
  }

  return (
    <div className="w-full">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => handleTabChange(index)}
            className={clsx(
              'px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap',
              activeTab === index
                ? 'border-cittaa-700 text-cittaa-700'
                : 'border-transparent text-gray-600 hover:text-app'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tabs[activeTab]?.content}
      </div>
    </div>
  )
}

export default Tabs
