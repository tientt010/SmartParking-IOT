const colorMap = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  red: "bg-red-500",
};

// eslint-disable-next-line
const StatsCard = ({ icon: IconComponent, label, value, sublabel, color }) => {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">{label}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {value}
            <span className="text-sm font-normal text-gray-400 ml-1">
              {sublabel}
            </span>
          </p>
        </div>
        <div
          className={`w-10 h-10 ${colorMap[color]} rounded-lg flex items-center justify-center`}
        >
          <IconComponent className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
