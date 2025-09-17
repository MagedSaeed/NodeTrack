import { Card } from './Card';

const Overview = ({ cards }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className="p-4 border bg-white border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">{card.title}</p>
              <p className="text-2xl font-bold text-slate-900">{card.value}</p>
            </div>
            <div className="p-2 rounded-md bg-slate-50 border-slate-100">
              <card.icon className="h-6 w-6 text-slate-600" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default Overview;