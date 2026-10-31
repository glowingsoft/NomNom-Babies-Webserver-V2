const babyPopulate = [
  {
    path: "babyStage",
    select: "_id title features",
  },
  {
    path: "selectedCountries",
    select: "_id name code signatureFoods",
  },
];

const getBabyInfo = (baby) => {
  if (!baby) return null;

  return {
    _id: baby._id,

    name: baby.name,

    parentName: baby.parentName || "",

    profileIcon: baby.profileIcon || "",

    stage: baby.babyStage
      ? {
          _id: baby.babyStage._id,
          title: baby.babyStage.title,
        }
      : null,

    countries:
      baby.selectedCountries?.map((country) => ({
        _id: country._id,
        name: country.name,
        code: country.code,
      })) || [],
  };
};

module.exports = {
  getBabyInfo,
  babyPopulate,
};
