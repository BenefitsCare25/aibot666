import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { employeeApi } from '../api/employees';
import toast from 'react-hot-toast';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState('skip');
  const [uploadResult, setUploadResult] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, [currentPage, searchTerm]);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await employeeApi.getAll({
        page: currentPage,
        limit: 20,
        search: searchTerm
      });

      setEmployees(response.data.employees);
      setTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      toast.error('Failed to load employees');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const result = await employeeApi.uploadExcel(file, duplicateAction, (progress) => {
        setUploadProgress(progress);
      });

      setUploadResult(result);

      // Show success message
      if (result.imported > 0 || result.updated > 0) {
        toast.success(result.message || 'Employees processed successfully!');
      }

      // Show warnings for duplicates
      if (result.duplicates && result.duplicates.length > 0) {
        if (duplicateAction === 'skip') {
          toast.warning(`${result.skipped} duplicate(s) were skipped`);
        } else {
          toast.success(`${result.updated} duplicate(s) were updated`);
        }
      }

      loadEmployees();
    } catch (error) {
      toast.error(error.message || 'Failed to upload employees');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  const handleDownloadTemplate = async () => {
    try {
      await employeeApi.downloadTemplate();
      toast.success('Template downloaded!');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600 mt-1">Manage employee data and policies</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <span>📥</span>
          Download Template
        </button>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload Employee Data</h2>

        {/* Duplicate Handling Option */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            How to handle duplicate Employee IDs:
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="duplicateAction"
                value="skip"
                checked={duplicateAction === 'skip'}
                onChange={(e) => setDuplicateAction(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Skip duplicates (keep existing)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="duplicateAction"
                value="update"
                checked={duplicateAction === 'update'}
                onChange={(e) => setDuplicateAction(e.target.value)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Update existing employees</span>
            </label>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400'
          } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="space-y-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-600">Uploading... {uploadProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3">📁</div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                {isDragActive ? 'Drop the file here' : 'Drag & drop Excel file here'}
              </p>
              <p className="text-sm text-gray-600">or click to browse (.xlsx, .xls)</p>
            </>
          )}
        </div>

        {/* Upload Result Summary */}
        {uploadResult && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Upload Summary</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>✅ New employees imported: <strong>{uploadResult.imported}</strong></p>
              {uploadResult.updated > 0 && (
                <p>🔄 Existing employees updated: <strong>{uploadResult.updated}</strong></p>
              )}
              {uploadResult.skipped > 0 && (
                <p>⏭️ Duplicates skipped: <strong>{uploadResult.skipped}</strong></p>
              )}
              {uploadResult.duplicates && uploadResult.duplicates.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">
                    View {uploadResult.duplicates.length} duplicate(s)
                  </summary>
                  <ul className="mt-2 ml-4 space-y-1">
                    {uploadResult.duplicates.map((dup, idx) => (
                      <li key={idx}>
                        {dup.employee_id} - {dup.name} ({dup.email})
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="Search by name, email, employee ID, or user ID..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Employee Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No employees found</p>
            <p className="text-sm text-gray-400 mt-1">Upload an Excel file to get started</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Policy Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Coverage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.employee_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.user_id || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {employee.policy_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        ${employee.coverage_limit?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
