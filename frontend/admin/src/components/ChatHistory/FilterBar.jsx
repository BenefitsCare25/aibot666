import { useState } from 'react';
import { format } from 'date-fns';

export default function FilterBar({ filters, onFilterChange }) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSearchChange = (e) => {
    onFilterChange({ ...filters, search: e.target.value });
  };

  const handleDateFromChange = (e) => {
    onFilterChange({ ...filters, dateFrom: e.target.value });
  };

  const handleDateToChange = (e) => {
    onFilterChange({ ...filters, dateTo: e.target.value });
  };

  const handleEscalatedToggle = () => {
    onFilterChange({ ...filters, escalatedOnly: !filters.escalatedOnly });
  };

  const handleClearFilters = () => {
    onFilterChange({
      search: '',
      dateFrom: '',
      dateTo: '',
      escalatedOnly: false
    });
    setShowDatePicker(false);
  };

  const hasActiveFilters = filters.search || filters.dateFrom || filters.dateTo || filters.escalatedOnly;

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 space-y-3">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={filters.search}
            onChange={handleSearchChange}
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>

        <button
          onClick={() => setShowDatePicker(!showDatePicker)}
          className={`px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors ${
            (filters.dateFrom || filters.dateTo) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300'
          }`}
        >
          📅 Date Range
        </button>

        <button
          onClick={handleEscalatedToggle}
          className={`px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors ${
            filters.escalatedOnly ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300'
          }`}
        >
          ⚠️ Escalated Only
        </button>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Date picker */}
      {showDatePicker && (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={handleDateFromChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={handleDateToChange}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          <button
            onClick={() => setShowDatePicker(false)}
            className="mt-5 px-3 py-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Done
          </button>
        </div>
      )}

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Active filters:</span>
          {filters.search && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Search: "{filters.search}"
            </span>
          )}
          {filters.dateFrom && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              From: {format(new Date(filters.dateFrom), 'MMM d, yyyy')}
            </span>
          )}
          {filters.dateTo && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              To: {format(new Date(filters.dateTo), 'MMM d, yyyy')}
            </span>
          )}
          {filters.escalatedOnly && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Escalated only
            </span>
          )}
        </div>
      )}
    </div>
  );
}
