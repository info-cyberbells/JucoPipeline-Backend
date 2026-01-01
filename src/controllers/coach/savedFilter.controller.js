import SavedFilter from "../../models/saved.filter.js";

export const saveFilter = async (req, res) => {
    try {
        const {
            name,
            queryParams,
            hittingStats = [],
            pitchingStats = []
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Filter name is required"
            });
        }

        const filter = await SavedFilter.create({
            userId: req.user._id,
            name,
            queryParams,
            hittingStats,
            pitchingStats
        });

        res.status(201).json({
            success: true,
            data: filter
        });
    } catch (error) {
        console.error("Save filter error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const getMyFilters = async (req, res) => {
    try {
        const filters = await SavedFilter.find({ userId: req.user._id })
            .select("name queryParams hittingStats pitchingStats createdAt")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: filters
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};

export const deleteFilter = async (req, res) => {
    try {
        const filter = await SavedFilter.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!filter) {
            return res.status(404).json({
                success: false,
                message: "Filter not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Filter deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


